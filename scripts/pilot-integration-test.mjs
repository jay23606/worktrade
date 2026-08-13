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
  assert.equal(before.member,true);
  const openRequest = await rpc(outsider.token,"create_work_request", {payload:{title:"Open registration check",description:"Authenticated accounts can participate without an invite code.",kind:"repair",publish:true,visibility:"public",exchange_modes:["barter"],skills:["Testing"]}});
  assert.ok(openRequest);
  await assert.rejects(() => rpc(outsider.token,"get_pilot_dashboard"), /admin authorization required/i);
  await assert.rejects(() => rpc(outsider.token,"create_pilot_invite", {invite_label:"Unauthorized",invite_max_uses:1}), /admin authorization required/i);
  assert.equal((await rpc(member.token,"get_pilot_access")).member,true);
  const discovery = await rpc(member.token,"discover_profiles",{search_text:"carpenter",exchange_filter:null,remote_only:false});
  assert.ok(Array.isArray(discovery));
  const feedbackId = await rpc(member.token,"submit_pilot_feedback",{feedback_category:"confusing",feedback_body:"The connected pilot feedback lifecycle needs a clear explanation.",feedback_view:"workspace",feedback_stage:"proposed",feedback_context:{test:true}});
  assert.ok(feedbackId);
  const dashboard = await rpc(admin.token,"get_pilot_dashboard");
  assert.ok(dashboard.metrics.members >= 1);
  assert.ok(dashboard.recent_members.some((item) => item.profile_id === member.id));
  assert.ok(dashboard.feedback.some((item) => item.id === feedbackId));
  await assert.rejects(() => rpc(outsider.token,"manage_pilot_feedback",{target_feedback_id:feedbackId,next_status:"closed",next_severity:"low"}), /admin authorization required/i);
  await rpc(admin.token,"manage_pilot_feedback",{target_feedback_id:feedbackId,next_status:"planned",next_severity:"high",assignee_id:admin.id,note:"Connected test note",public_reply:"Thanks. We have planned a clearer explanation."});
  const ownFeedback = await rpc(member.token,"get_my_pilot_feedback");
  assert.equal(ownFeedback[0].status,"planned");
  assert.equal(ownFeedback[0].replies[0].staff_reply,true);
  console.log("Open registration and admin authorization lifecycle passed.");
} finally { await cleanup(); }
