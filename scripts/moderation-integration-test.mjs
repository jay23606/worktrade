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
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok)
    throw Object.assign(
      new Error(data?.message || data?.hint || data?.error || `HTTP ${response.status}`),
      { status: response.status, data },
    );
  return data;
}

const rpc = (token, name, body = {}) =>
  request(`/rest/v1/rpc/${name}`, { token, method: "POST", body });

async function createUser(role) {
  const name = `Moderation ${role}`;
  const email = `worktrade-moderation-${role}-${run}@example.com`;
  const record = await request("/auth/v1/admin/users", {
    key: secret,
    token: secret,
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    },
  });
  created.push(record.id);
  await request("/rest/v1/pilot_memberships", { key: secret, token: secret, method: "POST", body: { profile_id: record.id } });
  const session = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  const user = { id: record.id, token: session.access_token, name };
  await rpc(user.token, "set_my_profile", {
    payload: {
      display_name: name,
      location_text: "Richmond, VA",
      bio: "Temporary moderation lifecycle account",
      needs: [],
      offers: [],
    },
  });
  return user;
}

async function cleanup() {
  for (const id of created.reverse()) {
    try {
      await request(`/auth/v1/admin/users/${id}`, {
        key: secret,
        token: secret,
        method: "DELETE",
      });
    } catch {}
  }
}

try {
  const [reporter, target, staff] = await Promise.all([
    createUser("Reporter"),
    createUser("Target"),
    createUser("Staff"),
  ]);
  await request("/rest/v1/moderation_roles", {
    key: secret,
    token: secret,
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: { profile_id: staff.id, role: "admin" },
  });

  const requestId = await rpc(target.token, "create_work_request", {
    payload: {
      title: "Moderation lifecycle test request",
      description: "Temporary request used to validate private safety reporting.",
      kind: "build",
      publish: true,
      visibility: "public",
      exchange_modes: ["barter"],
      skills: ["Testing"],
    },
  });
  const reportId = await rpc(reporter.token, "submit_safety_report", {
    report_target_type: "request",
    report_target_id: requestId,
    report_category: "unsafe_work",
    report_detail: "The listing asks for work without the required safety controls.",
  });

  await assert.rejects(
    () => rpc(target.token, "get_moderation_queue"),
    /staff authorization/i,
  );
  const queue = await rpc(staff.token, "get_moderation_queue");
  assert.equal(queue.role, "admin");
  assert.ok(queue.reports.some((report) => report.id === reportId));

  await rpc(staff.token, "moderate_report", {
    target_report_id: reportId,
    moderation_action: "restricted",
    internal_note_value: "Posting is paused while required safety controls are verified.",
    reporter_update_value: "WorkTrade reviewed the concern and restricted the reported account.",
    restriction_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });
  const restrictions = await request(
    "/rest/v1/account_restrictions?lifted_at=is.null&select=*",
    { token: target.token },
  );
  assert.equal(restrictions.length, 1);
  await assert.rejects(
    () =>
      rpc(target.token, "create_work_request", {
        payload: {
          title: "Blocked interaction attempt",
          description: "This write must be rejected while restricted.",
          kind: "build",
          publish: false,
          skills: [],
        },
      }),
    /account interaction restricted/i,
  );

  const reporterView = await rpc(reporter.token, "get_my_safety_reports");
  assert.equal(reporterView[0].reporter_status, "action_taken");
  assert.equal(reporterView[0].reporter_update.includes("restricted"), true);
  assert.deepEqual(
    await request(
      `/rest/v1/moderation_actions?report_id=eq.${reportId}&select=*`,
      { token: reporter.token },
    ),
    [],
  );

  const appealId = await rpc(target.token, "submit_moderation_appeal", {
    target_restriction_id: restrictions[0].id,
    appeal_statement:
      "The request has been corrected with documented controls, protective equipment, and a qualified supervisor.",
  });
  const appealQueue = await rpc(staff.token, "get_moderation_queue");
  assert.ok(appealQueue.appeals.some((appeal) => appeal.id === appealId));
  await rpc(staff.token, "resolve_moderation_appeal", {
    target_appeal_id: appealId,
    appeal_decision: "granted",
    internal_note_value: "Submitted controls adequately address the original concern.",
    member_update_value: "Your appeal was granted and the interaction restriction was lifted.",
  });

  const restoredRequestId = await rpc(target.token, "create_work_request", {
    payload: {
      title: "Restored interaction test",
      description: "A permitted draft after successful appeal review.",
      kind: "build",
      publish: false,
      skills: [],
    },
  });
  assert.ok(restoredRequestId);
  const actions = await request(
    `/rest/v1/moderation_actions?report_id=eq.${reportId}&select=*`,
    { token: staff.token },
  );
  assert.deepEqual(
    actions.map((action) => action.action),
    ["restricted", "restriction_lifted"],
  );
  await assert.rejects(
    () =>
      request(`/rest/v1/moderation_actions?id=eq.${actions[0].id}`, {
        key: secret,
        token: secret,
        method: "PATCH",
        body: { internal_note: "Attempted rewrite" },
      }),
    /immutable/i,
  );
  console.log(
    "WorkTrade reporting, restriction, appeal, reinstatement, and immutable-audit lifecycle passed against hosted Supabase.",
  );
} finally {
  await cleanup();
}
