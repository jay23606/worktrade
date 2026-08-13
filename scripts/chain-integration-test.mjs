import assert from "node:assert/strict";

const base = process.env.WT_SUPABASE_URL;
const publishable = process.env.WT_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.WT_SUPABASE_SECRET_KEY;
if (!base || !publishable || !secret)
  throw new Error("Integration test credentials are not configured");

const run = Date.now();
const password = `Wt-${crypto.randomUUID()}-Aa9!`;
const userSpecs = [
  ["owner", "Circle Owner"],
  ["builder", "Chain Builder"],
  ["designer", "Chain Designer"],
  ["outsider", "Circle Outsider"],
].map(([role, name]) => ({
  role,
  name,
  email: `worktrade-${role}-${run}@example.com`,
}));
const createdUserIds = [];

async function request(
  path,
  {
    key = publishable,
    token = key,
    method = "GET",
    body,
    headers = {},
  } = {},
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
      new Error(
        data?.message ||
          data?.error_description ||
          data?.hint ||
          data?.error ||
          `HTTP ${response.status}`,
      ),
      { status: response.status, data },
    );
  return data;
}

const rpc = (token, name, body = {}) =>
  request(`/rest/v1/rpc/${name}`, { token, method: "POST", body });

async function createUser(spec) {
  const record = await request("/auth/v1/admin/users", {
    key: secret,
    token: secret,
    method: "POST",
    body: {
      email: spec.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: spec.name },
    },
  });
  createdUserIds.push(record.id);
  const session = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email: spec.email, password },
  });
  return { ...spec, id: record.id, token: session.access_token };
}

async function cleanup() {
  for (const id of createdUserIds.reverse()) {
    try {
      await request(`/auth/v1/admin/users/${id}`, {
        key: secret,
        token: secret,
        method: "DELETE",
      });
    } catch {}
  }
}

async function getChain(user, circleId, chainId) {
  const [rows, links, acceptances, holds, history] = await Promise.all([
    request(`/rest/v1/trade_chains?id=eq.${chainId}&circle_id=eq.${circleId}&select=*`, { token:user.token }),
    request(`/rest/v1/trade_chain_links?chain_id=eq.${chainId}&select=*`, { token:user.token }),
    request(`/rest/v1/trade_chain_acceptances?chain_id=eq.${chainId}&select=*`, { token:user.token }),
    request(`/rest/v1/trade_chain_holds?chain_id=eq.${chainId}&select=*`, { token:user.token }),
    request(`/rest/v1/trade_chain_history?chain_id=eq.${chainId}&select=*`, { token:user.token }),
  ]);
  return { ...rows[0], links, acceptances, holds, history };
}

function linksFor(users, suffix = "") {
  const [owner, builder, designer] = users;
  return [
    {
      from_profile_id: owner.id,
      to_profile_id: builder.id,
      value_description: `Product photos${suffix}`,
      position: 0,
      due_at: "",
      conditions: "Workspace is accessible",
    },
    {
      from_profile_id: builder.id,
      to_profile_id: designer.id,
      value_description: `Storage shelves${suffix}`,
      position: 1,
      due_at: "",
      conditions: "Measurements are confirmed",
    },
    {
      from_profile_id: designer.id,
      to_profile_id: owner.id,
      value_description: `Brand layout${suffix}`,
      position: 2,
      due_at: "",
      conditions: "Photos are delivered",
    },
  ];
}

try {
  const users = await Promise.all(userSpecs.map(createUser));
  const [owner, builder, designer, outsider] = users;
  for (const user of users)
    await rpc(user.token, "set_my_profile", {
      payload: {
        display_name: user.name,
        location_text: "Richmond, VA",
        bio: `${user.role} hosted chain test account`,
        needs: ["Photography", "Carpentry", "Design"],
        offers: ["Photography", "Carpentry", "Design"],
      },
    });

  const circleId = await rpc(owner.token, "create_circle", {
    circle_name: "Hosted reciprocal workshop",
    circle_description: "Private integration-test circle",
    circle_visibility: "private",
    circle_rules: "Confirm every exchange before work begins.",
  });
  for (const member of [builder, designer]) {
    await rpc(member.token, "request_circle_membership", {
      target_circle_id: circleId,
    });
    await rpc(owner.token, "manage_circle_membership", {
      target_circle_id: circleId,
      target_profile_id: member.id,
      member_action: "approve",
      new_role: null,
    });
  }

  const resourceId = await rpc(owner.token, "save_circle_resource", {
    target_circle_id: circleId,
    resource_id: null,
    payload: {
      kind: "workspace",
      name: "Shared workshop bay",
      description: "Covered assembly space",
      availability: "Weekends",
    },
  });
  const circleRequestId = await rpc(builder.token, "create_circle_request", {
    target_circle_id: circleId,
    payload: {
      title: "Build a rolling material cart",
      description: "Design and assemble a compact shop cart.",
      kind: "build",
      publish: true,
      location: "Richmond, VA",
      urgency: "This month",
      cash_budget_cents: "",
      exchange_modes: ["barter"],
      exchange_summary: "Carpentry exchanged for design help",
      constraints: "Must fit a 30-inch doorway",
      skills: ["Carpentry", "Design"],
    },
  });

  for (const [table, id] of [
    ["circles", circleId],
    ["circle_resources", resourceId],
    ["work_requests", circleRequestId],
  ]) {
    const rows = await request(`/rest/v1/${table}?id=eq.${id}&select=id`, {
      token: outsider.token,
    });
    assert.deepEqual(rows, [], `outsider read private ${table}`);
  }
  const memberRows = await request(
    `/rest/v1/circle_members?circle_id=eq.${circleId}&select=profile_id`,
    { token: outsider.token },
  );
  assert.deepEqual(memberRows, []);

  const initialLinks = linksFor([owner, builder, designer]);
  const chainId = await rpc(owner.token, "create_trade_chain", {
    target_circle_id: circleId,
    chain_title: "Workshop launch exchange",
    chain_description: "Photography, carpentry, and design in one loop.",
    execution_value: "sequential",
    links: initialLinks,
  });
  assert.deepEqual(
    await request(`/rest/v1/trade_chains?id=eq.${chainId}&select=id`, {
      token: outsider.token,
    }),
    [],
  );
  assert.deepEqual(
    (await rpc(outsider.token, "get_trade_chain_hub", {
      target_circle_id: circleId,
    })).chains,
    [],
  );

  await rpc(owner.token, "accept_trade_chain", {
    target_chain_id: chainId,
    expected_version: 1,
  });
  await rpc(builder.token, "accept_trade_chain", {
    target_chain_id: chainId,
    expected_version: 1,
  });
  assert.equal((await getChain(owner, circleId, chainId)).status, "proposed");
  await assert.rejects(
    () => rpc(owner.token, "activate_trade_chain", { target_chain_id: chainId }),
    /fully accepted/i,
  );
  await rpc(designer.token, "accept_trade_chain", {
    target_chain_id: chainId,
    expected_version: 1,
  });
  assert.equal((await getChain(owner, circleId, chainId)).status, "accepted");

  const revisedLinks = linksFor([owner, builder, designer], " — revised");
  await rpc(builder.token, "revise_trade_chain", {
    target_chain_id: chainId,
    expected_version: 1,
    payload: {
      title: "Workshop launch exchange v2",
      description: "Reconfirmed reciprocal scope.",
      execution_mode: "sequential",
      links: revisedLinks,
    },
  });
  let chain = await getChain(owner, circleId, chainId);
  assert.equal(chain.version, 2);
  assert.equal(chain.status, "proposed");
  assert.equal(chain.acceptances.length, 0);
  await assert.rejects(
    () =>
      rpc(owner.token, "accept_trade_chain", {
        target_chain_id: chainId,
        expected_version: 1,
      }),
    /current proposed/i,
  );
  for (const participant of [owner, builder, designer])
    await rpc(participant.token, "accept_trade_chain", {
      target_chain_id: chainId,
      expected_version: 2,
    });
  await rpc(owner.token, "activate_trade_chain", {
    target_chain_id: chainId,
  });

  chain = await getChain(owner, circleId, chainId);
  const ordered = [...chain.links].sort((a, b) => a.position - b.position);
  await assert.rejects(
    () =>
      rpc(builder.token, "manage_trade_chain_link", {
        target_link_id: ordered[1].id,
        link_action: "fulfill",
        note: "Attempted out of sequence",
      }),
    /earlier links/i,
  );
  await rpc(designer.token, "manage_trade_chain", {
    target_chain_id: chainId,
    chain_action: "hold",
    payload: {
      link_id: ordered[0].id,
      kind: "materials",
      detail: "Waiting for backdrop paper",
      action_owner_id: owner.id,
      review_at: new Date(Date.now() + 86_400_000).toISOString(),
    },
  });
  await assert.rejects(
    () =>
      rpc(owner.token, "manage_trade_chain_link", {
        target_link_id: ordered[0].id,
        link_action: "fulfill",
        note: "Photos ready",
      }),
    /resolve dependency hold/i,
  );
  chain = await getChain(owner, circleId, chainId);
  await rpc(owner.token, "manage_trade_chain", {
    target_chain_id: chainId,
    chain_action: "resolve_hold",
    payload: { hold_id: chain.holds.find((hold) => !hold.resolved_at).id },
  });

  const steps = [
    [owner, builder, ordered[0]],
    [builder, designer, ordered[1]],
    [designer, owner, ordered[2]],
  ];
  for (const [provider, recipient, link] of steps) {
    await rpc(provider.token, "manage_trade_chain_link", {
      target_link_id: link.id,
      link_action: "fulfill",
      note: `${link.value_description} delivered`,
    });
    await assert.rejects(
      () =>
        rpc(provider.token, "manage_trade_chain_link", {
          target_link_id: link.id,
          link_action: "approve",
          note: "Self approval",
        }),
      /link action unavailable/i,
    );
    await rpc(recipient.token, "manage_trade_chain_link", {
      target_link_id: link.id,
      link_action: "approve",
      note: "Accepted",
    });
  }
  chain = await getChain(owner, circleId, chainId);
  assert.equal(chain.status, "completed");
  assert.ok(chain.links.every((link) => link.approved_at));
  assert.ok(chain.history.length >= 12);

  const failedChainId = await rpc(owner.token, "create_trade_chain", {
    target_circle_id: circleId,
    chain_title: "Failure-handling exchange",
    chain_description: "Exercises an explicit dispute.",
    execution_value: "simultaneous",
    links: initialLinks,
  });
  for (const participant of [owner, builder, designer])
    await rpc(participant.token, "accept_trade_chain", {
      target_chain_id: failedChainId,
      expected_version: 1,
    });
  await rpc(designer.token, "activate_trade_chain", {
    target_chain_id: failedChainId,
  });
  await rpc(builder.token, "manage_trade_chain", {
    target_chain_id: failedChainId,
    chain_action: "disputed",
    payload: { detail: "Scope could not be completed safely." },
  });
  assert.equal(
    (await getChain(owner, circleId, failedChainId)).status,
    "disputed",
  );

  console.log(
    "WorkTrade private-circle and three-party trade-chain lifecycle passed against hosted Supabase.",
  );
} finally {
  await cleanup();
}
