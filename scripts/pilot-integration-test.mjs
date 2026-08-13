import assert from "node:assert/strict";

const base = process.env.WT_SUPABASE_URL;
const publishable = process.env.WT_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.WT_SUPABASE_SECRET_KEY;
if (!base || !publishable || !secret) throw new Error("Integration test credentials are not configured");
const run = Date.now();
const password = `Wt-${crypto.randomUUID()}-Aa9!`;
const users = [];
const invites = [];

async function request(path, { key=publishable, token=key, method="GET", body, headers={} }={}) {
  const response = await fetch(`${base}${path}`, { method, headers: { apikey:key, Authorization:`Bearer ${token}`, "Content-Type":"application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw Object.assign(new Error(data?.message || data?.hint || data?.error || `HTTP ${response.status}`), { status: response.status, data });
  return data;
}
const rpc = (token,name,body={}) => request(`/rest/v1/rpc/${name}`, { token, method:"POST", body });

async function createUser(label) {
  const email = `worktrade-pilot-${label}-${run}@example.com`;
  const record = await request("/auth/v1/admin/users", { key:secret, token:secret, method:"POST", body:{ email,password,email_confirm:true,user_metadata:{display_name:`Pilot ${label}`} } });
  users.push(record.id);
  const session = await request("/auth/v1/token?grant_type=password", { method:"POST", body:{email,password} });
  return { id:record.id, token:session.access_token };
}

async function cleanup() {
  for (const id of invites) try { await request(`/rest/v1/pilot_invite_codes?id=eq.${id}`, { key:secret,token:secret,method:"DELETE" }); } catch {}
  for (const id of users.reverse()) try { await request(`/auth/v1/admin/users/${id}`, { key:secret,token:secret,method:"DELETE" }); } catch {}
}

try {
  const [admin, member, outsider] = await Promise.all([createUser("admin"),createUser("member"),createUser("outsider")]);
  await request("/rest/v1/moderation_roles", { key:secret,token:secret,method:"POST",headers:{Prefer:"return=minimal"},body:{profile_id:admin.id,role:"admin"} });
  const before = await rpc(member.token,"get_pilot_access");
  assert.equal(before.member,false);
  await assert.rejects(() => rpc(outsider.token,"create_work_request", {payload:{title:"Blocked pilot bypass",description:"This write must require pilot membership.",kind:"repair",publish:true,visibility:"public",exchange_modes:["barter"],skills:["Testing"]}}), /account interaction restricted/i);
  await assert.rejects(() => rpc(outsider.token,"get_pilot_dashboard"), /admin authorization required/i);
  await assert.rejects(() => rpc(outsider.token,"create_pilot_invite", {invite_label:"Unauthorized",invite_max_uses:1}), /admin authorization required/i);
  const invite = await rpc(admin.token,"create_pilot_invite", {invite_label:"Connected test",invite_max_uses:1});
  invites.push(invite.id);
  assert.match(invite.code,/^WT-[A-F0-9]{32}$/);
  await rpc(member.token,"redeem_pilot_invite",{invite_code:invite.code.toLowerCase()});
  assert.equal((await rpc(member.token,"get_pilot_access")).member,true);
  await assert.rejects(() => rpc(outsider.token,"redeem_pilot_invite",{invite_code:invite.code}), /invalid or no longer available/i);
  const dashboard = await rpc(admin.token,"get_pilot_dashboard");
  assert.ok(dashboard.metrics.members >= 1);
  assert.ok(dashboard.invites.some((item) => item.id === invite.id && item.use_count === 1));
  assert.ok(dashboard.recent_members.some((item) => item.profile_id === member.id));
  console.log("Invite-only pilot authorization and redemption lifecycle passed.");
} finally { await cleanup(); }
