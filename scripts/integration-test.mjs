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
  { email: `worktrade-decline-${run}@example.com`, name: "Integration Decliner" },
];
const created = [];
const uploaded = [];
const messageUploads = [];

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
  for (const path of messageUploads) {
    try { await fetch(`${base}/storage/v1/object/message-attachments/${path}`, { method: "DELETE", headers: { apikey: secret, Authorization: `Bearer ${secret}` } }); } catch {}
  }
  for (const id of created) {
    try { await request(`/auth/v1/admin/users/${id}`, { key: secret, token: secret, method: "DELETE" }); } catch {}
  }
}

try {
  const owner = await createUser(users[0]);
  const provider = await createUser(users[1]);
  const decliner = await createUser(users[2]);

  await rpc(owner.token, "set_my_profile", { payload: { display_name: owner.name, location_text: "Richmond, VA", bio: "Owner test account", needs: ["Carpentry"], offers: ["Photography"] } });
  await rpc(provider.token, "set_my_profile", { payload: { display_name: provider.name, location_text: "Richmond, VA", location_visibility: "private", bio: "Provider test account", needs: ["Photography"], offers: ["Carpentry"] } });
  await rpc(decliner.token, "set_my_profile", { payload: { display_name: decliner.name, bio: "Decline-path test account", needs: ["Gardening"], offers: ["Painting"] } });
  const declinedId = await rpc(owner.token, "send_contact_request", { target_profile_id: decliner.id, message_body: "Would you like to discuss a small painting project?", target_request_id: null, contact_kind: "message" });
  await rpc(decliner.token, "respond_collaboration_invitation", { target_invitation_id: declinedId, response: "declined" });
  const declinedInbox = await rpc(owner.token, "get_network_inbox", {});
  assert.equal(declinedInbox.invitations.find((item) => item.id === declinedId).status, "declined");
  const discovery = await rpc(owner.token, "discover_profiles", { search_text: provider.name, exchange_filter: null, remote_only: false });
  const discoveredProvider = discovery.find((row) => row.profile.id === provider.id).profile;
  assert.equal(discoveredProvider.location_text, null);
  assert.equal(discoveredProvider.location_band, "Location private");
  assert.ok(discoveredProvider.match_score > 0);
  assert.ok(discoveredProvider.match_reasons.includes("Offers what you need"));
  await rpc(owner.token, "record_match_event", { profile_value: provider.id, request_value: null, event_value: "dismissed", reason_value: "timing" });
  const reranked = await rpc(owner.token, "discover_profiles", { search_text: provider.name, exchange_filter: null, remote_only: false });
  const rerankedProvider = reranked.find((row) => row.profile.id === provider.id)?.profile;
  assert.ok(!rerankedProvider || rerankedProvider.match_score < discoveredProvider.match_score, "dismissed matches should rank lower or leave the result set");

  const contactId = await rpc(owner.token, "send_contact_request", { target_profile_id: provider.id, message_body: "Could I ask you a quick question about your carpentry availability?", target_request_id: null, contact_kind: "message" });
  let contactInbox = await rpc(provider.token, "get_network_inbox", {});
  const contact = contactInbox.invitations.find((item) => item.id === contactId);
  assert.equal(contact.invitation_kind, "message");
  assert.match(contact.note, /quick question/);
  const reciprocalContactId = await rpc(provider.token, "send_contact_request", { target_profile_id: owner.id, message_body: "Yes—Saturday mornings are usually available.", target_request_id: null, contact_kind: "message" });
  assert.equal(reciprocalContactId, contactId, "reciprocal contact should open the same conversation");
  contactInbox = await rpc(provider.token, "get_network_inbox", {});
  assert.equal(contactInbox.invitations.find((item) => item.id === contactId).status, "accepted");
  assert.equal(contactInbox.invitations.filter((item) => [item.sender_id,item.recipient_id].includes(owner.id) && [item.sender_id,item.recipient_id].includes(provider.id) && ["pending","accepted","converted"].includes(item.status)).length, 1);
  await rpc(owner.token, "send_introduction_message", { target_invitation_id: contactId, message_body: "Thanks for opening the conversation." });
  contactInbox = await rpc(provider.token, "get_network_inbox", {});
  assert.equal(contactInbox.messages.some((item) => item.invitation_id === contactId), true);
  assert.equal(Number(contactInbox.invitations.find((item) => item.id === contactId).unread_count), 1);
  await rpc(provider.token, "manage_conversation", { target_invitation_id: contactId, requested_action: "read" });
  await rpc(provider.token, "manage_conversation", { target_invitation_id: contactId, requested_action: "mute" });
  contactInbox = await rpc(provider.token, "get_network_inbox", {});
  assert.equal(Number(contactInbox.invitations.find((item) => item.id === contactId).unread_count), 0);
  assert.equal(contactInbox.invitations.find((item) => item.id === contactId).member_state.muted, true);
  let ownerContactInbox = await rpc(owner.token, "get_network_inbox", {});
  assert.ok(ownerContactInbox.invitations.find((item) => item.id === contactId).other_read_at);
  await rpc(provider.token, "manage_conversation", { target_invitation_id: contactId, requested_action: "archive" });
  contactInbox = await rpc(provider.token, "get_network_inbox", {});
  assert.ok(contactInbox.invitations.find((item) => item.id === contactId).member_state.archived_at);
  await rpc(provider.token, "manage_conversation", { target_invitation_id: contactId, requested_action: "restore" });
  contactInbox = await rpc(provider.token, "get_network_inbox", {});
  assert.equal(contactInbox.invitations.find((item) => item.id === contactId).member_state.archived_at, null);
  const attachmentPath = `${contactId}/${owner.id}/${crypto.randomUUID()}.txt`;
  const attachmentBody = "Private WorkTrade attachment test";
  const attachmentUploadResponse = await fetch(`${base}/storage/v1/object/message-attachments/${attachmentPath}`, { method: "POST", headers: { apikey: publishable, Authorization: `Bearer ${owner.token}`, "Content-Type": "text/plain", "x-upsert": "false" }, body: attachmentBody });
  if (!attachmentUploadResponse.ok) throw new Error(`Attachment upload failed: ${await attachmentUploadResponse.text()}`);
  messageUploads.push(attachmentPath);
  const attachmentMessageId = await rpc(owner.token, "send_message_with_attachment", { target_invitation_id: contactId, message_body: "Here is the requested note.", attachment_path: attachmentPath, attachment_name: "worktrade-note.txt", attachment_type: "text/plain", attachment_size: Buffer.byteLength(attachmentBody) });
  contactInbox = await rpc(provider.token, "get_network_inbox", {});
  assert.equal(contactInbox.attachments.some((item) => item.message_id === attachmentMessageId && item.file_name === "worktrade-note.txt"), true);

  const invitationId = await rpc(owner.token, "send_collaboration_invitation", { target_profile_id: provider.id, need_value: "Carpentry for workshop storage", offer_value: "Product photography", note_value: "A reciprocal fit for both profiles", target_request_id: null });
  assert.equal(invitationId, contactId, "formal exchange should reuse the existing conversation");
  let inbox = await rpc(provider.token, "get_network_inbox", {});
  assert.equal(inbox.invitations.filter((item) => [item.sender_id,item.recipient_id].includes(owner.id) && [item.sender_id,item.recipient_id].includes(provider.id) && ["pending","accepted","converted"].includes(item.status)).length, 1);
  assert.equal(inbox.invitations.find((item) => item.id === invitationId).status, "accepted");
  await rpc(owner.token, "send_introduction_message", { target_invitation_id: invitationId, message_body: "Let’s define the shelves, access, and exchange before committing." });
  inbox = await rpc(provider.token, "get_network_inbox", {});
  assert.equal(inbox.messages.some((item) => item.invitation_id === invitationId), true);
  let workspace = await rpc(owner.token, "update_introduction_workspace", { target_invitation_id: invitationId, expected_version: 1, payload: { scope: "Build and install two workshop shelves", responsibilities: { [owner.id]: "Provide lumber and access", [provider.id]: "Provide tools and labor" }, materials: "Owner supplies lumber; provider supplies fasteners", exclusions: "No painting or electrical work", exchange_terms: "Carpentry for a product photography session", proposed_windows: "Saturday morning", timezone: "America/New_York" } });
  await rpc(owner.token, "confirm_introduction_workspace", { target_invitation_id: invitationId, expected_version: workspace.version });
  workspace = await rpc(provider.token, "update_introduction_workspace", { target_invitation_id: invitationId, expected_version: workspace.version, payload: { scope: "Build and install two reinforced workshop shelves", proposed_windows: "Saturday morning after 9" } });
  assert.equal(workspace.sender_confirmed_version, null);
  assert.equal(workspace.recipient_confirmed_version, null);
  await assert.rejects(() => rpc(owner.token, "convert_introduction_to_request", { target_invitation_id: invitationId }), /both participants must confirm current terms/i);
  await rpc(owner.token, "confirm_introduction_workspace", { target_invitation_id: invitationId, expected_version: workspace.version });
  await rpc(provider.token, "confirm_introduction_workspace", { target_invitation_id: invitationId, expected_version: workspace.version });
  const privateRequestId = await rpc(provider.token, "convert_introduction_to_request", { target_invitation_id: invitationId });
  const privateDraft = (await request(`/rest/v1/work_requests?id=eq.${privateRequestId}&select=*`, { token: provider.token }))[0];
  assert.equal(privateDraft.stage, "draft");
  assert.equal(privateDraft.visibility, "private");
  inbox = await rpc(owner.token, "get_network_inbox", {});
  assert.equal(inbox.invitations.find((item) => item.id === invitationId).status, "converted");

  const draftId=await rpc(owner.token,"create_work_request",{payload:{title:"Draft workshop planning request",description:"An intentionally unpublished draft for lifecycle testing.",kind:"build",publish:false,skills:["Planning"]}});
  let draft=(await request(`/rest/v1/work_requests?id=eq.${draftId}&select=*`,{token:owner.token}))[0];assert.equal(draft.stage,"draft");
  await rpc(owner.token,"request_lifecycle_action",{target_request_id:draftId,expected_version:draft.version,requested_action:"publish"});draft=(await request(`/rest/v1/work_requests?id=eq.${draftId}&select=*`,{token:owner.token}))[0];assert.equal(draft.stage,"open");
  const duplicateId=await rpc(owner.token,"request_lifecycle_action",{target_request_id:draftId,expected_version:draft.version,requested_action:"duplicate"});const duplicate=(await request(`/rest/v1/work_requests?id=eq.${duplicateId}&select=*`,{token:owner.token}))[0];assert.equal(duplicate.stage,"draft");

  const requestId = await rpc(owner.token, "create_work_request", { payload: { title: "Build integration-test shelving", description: "Build and install two sturdy workshop shelves.", kind: "build", location: "Richmond, VA", urgency: "This month", cash_budget_cents: 30000, visibility: "public", skills: ["Carpentry"] } });
  await rpc(decliner.token, "set_my_profile", { payload: { display_name: decliner.name, location_text: "Richmond, VA", bio: "Decline-path test account", needs: ["Gardening"], offers: ["Carpentry"] } });
  const projectMatches = await rpc(owner.token, "recommend_profiles_for_request", { target_request_id: requestId });
  const projectProvider = projectMatches[0];
  assert.ok(projectProvider?.score >= 30, "expected at least one strong project match");
  assert.ok(projectProvider.reasons.includes("Matches required skills"));
  assert.ok(await rpc(owner.token, "notify_project_matches", { target_request_id: requestId }) >= 1);
  let remoteRequest = (await request(`/rest/v1/work_requests?id=eq.${requestId}&select=*`, { token:owner.token }))[0];
  await rpc(owner.token,"update_work_request",{target_request_id:requestId,expected_version:remoteRequest.version,payload:{title:"Build integration-test workshop shelving",description:remoteRequest.description,kind:"build",location:"Richmond, VA",urgency:"Within two weeks",cash_budget_cents:30000,skills:["Carpentry","Installation"]}});
  const offerId = await rpc(provider.token, "submit_trade_offer", { target_request_id: requestId, payload: { mode: "hybrid", scope: "Build and install two shelves", exchange_summary: "$200 and a product photography session", duration: "One weekend",exclusions:"Wall painting",responsibilities:{provider:"Tools and labor",requester:"Lumber and site access"},milestones:[{title:"Confirm measurements",responsible:"requester",due_at:""},{title:"Build and install",responsible:"provider",due_at:""}],questions:"Is Saturday access available?",expires_at:new Date(Date.now()+604800000).toISOString() } });
  await rpc(provider.token,"revise_trade_offer",{target_offer_id:offerId,payload:{mode:"hybrid",scope:"Build and install two reinforced shelves",exchange_summary:"$200 and a product photography session",duration:"One weekend",exclusions:"Wall painting",responsibilities:{provider:"Tools and labor",requester:"Lumber and access"},milestones:[{title:"Confirm measurements",responsible:"requester",due_at:""},{title:"Build and install",responsible:"provider",due_at:""}],questions:"Is Saturday access available?",expires_at:new Date(Date.now()+604800000).toISOString()}});
  let notifications = await rpc(owner.token,"get_my_notifications",{});
  assert.equal(notifications.some((row)=>row.notification.kind==="proposal"),true);

  await assert.rejects(() => rpc(provider.token, "accept_trade_offer", { target_offer_id: offerId }), /counterparty acceptance required/i);
  const counter=await rpc(owner.token,"counter_trade_offer",{target_offer_id:offerId,payload:{mode:"hybrid",scope:"Build and install two reinforced shelves",exchange_summary:"$175 and a product photography session",duration:"One weekend",exclusions:"Wall painting",responsibilities:{provider:"Tools and labor",requester:"Lumber and access"},milestones:[{title:"Confirm measurements",responsible:"requester",due_at:""},{title:"Build and install",responsible:"provider",due_at:""}],questions:"Countered to $175; Saturday access is confirmed.",expires_at:new Date(Date.now()+604800000).toISOString()}});
  assert.equal(counter.version,2);
  await assert.rejects(() => rpc(owner.token, "accept_trade_offer", { target_offer_id: offerId }), /counterparty acceptance required/i);
  const versions=await request(`/rest/v1/trade_offer_versions?offer_id=eq.${offerId}&select=*`,{token:provider.token});assert.equal(versions.length,1);assert.equal(versions[0].version,1);
  const agreementId = await rpc(provider.token, "accept_trade_offer", { target_offer_id: offerId });

  let rows = await rpc(owner.token, "get_my_agreements", {});
  let agreement = rows.find((row) => row.agreement.id === agreementId);
  assert.equal(agreement.agreement.status, "proposed");
  assert.equal(agreement.obligations.length, 2);
  await rpc(owner.token,"manage_milestone",{target_agreement_id:agreementId,expected_version:agreement.agreement.version,action:"add",payload:{title:"Final fit check",responsible_profile_id:owner.id,due_at:""}});rows=await rpc(owner.token,"get_my_agreements",{});agreement=rows[0];assert.equal(agreement.milestones.some((m)=>m.title==="Final fit check"),true);

  await edgeAction(owner.token, "confirm", agreementId, agreement.agreement.version);
  rows = await rpc(provider.token, "get_my_agreements", {}); agreement = rows[0];
  await rpc(provider.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "confirm", payload: {} });
  rows = await rpc(owner.token, "get_my_agreements", {}); agreement = rows[0];
  assert.equal(agreement.agreement.status, "agreed");

  const amendmentId=await rpc(owner.token,"propose_agreement_amendment",{target_agreement_id:agreementId,expected_version:agreement.agreement.version,payload:{scope:"Build and install two reinforced shelves",exchange:{mode:"hybrid",summary:"$200 and a product photography session"},reason:"The stored equipment is heavier than expected."}});
  await rpc(provider.token,"respond_agreement_amendment",{target_amendment_id:amendmentId,accept:true});
  rows=await rpc(owner.token,"get_my_agreements",{});agreement=rows[0];assert.equal(agreement.agreement.status,"proposed");
  await rpc(owner.token,"perform_agreement_action",{target_agreement_id:agreementId,expected_version:agreement.agreement.version,requested_action:"confirm",payload:{}});
  rows=await rpc(provider.token,"get_my_agreements",{});agreement=rows[0];
  await rpc(provider.token,"perform_agreement_action",{target_agreement_id:agreementId,expected_version:agreement.agreement.version,requested_action:"confirm",payload:{}});
  rows=await rpc(owner.token,"get_my_agreements",{});agreement=rows[0];assert.equal(agreement.agreement.status,"agreed");

  const ledgerItemId=await rpc(owner.token,"save_ledger_item",{target_agreement_id:agreementId,target_item_id:null,payload:{item_type:"material",description:"Reinforced shelf brackets",responsibility:"shared",contribution_mode:"cash",quantity:"8",unit:"brackets",estimated_cost_cents:"6400",barter_description:"",status:"needed"}});
  await rpc(owner.token,"manage_ledger_item",{target_item_id:ledgerItemId,item_action:"approve",payload:{}});await rpc(provider.token,"manage_ledger_item",{target_item_id:ledgerItemId,item_action:"approve",payload:{}});
  await rpc(provider.token,"manage_ledger_item",{target_item_id:ledgerItemId,item_action:"status",payload:{status:"ready",quantity_actual:"8",actual_cost_cents:"6125"}});
  const ledger=await rpc(owner.token,"get_agreement_ledger",{target_agreement_id:agreementId});assert.equal(ledger.items[0].approvals.length,2);assert.equal(ledger.summary.needed,0);assert.equal(ledger.summary.actual_cash_cents,6125);

  await rpc(owner.token,"save_my_availability",{payload:{timezone:"America/New_York",weekly_windows:["Saturday 8am-2pm"],lead_time_hours:24}});
  const scheduleId=await rpc(owner.token,"propose_schedule_window",{target_agreement_id:agreementId,payload:{start_at:new Date(Date.now()+172800000).toISOString(),end_at:new Date(Date.now()+176400000).toISOString(),timezone:"America/New_York",weather_sensitive:true,location_detail:"Private test workshop",arrival_notes:"Use the side entrance"}});
  let scheduleHub=await rpc(provider.token,"get_agreement_schedule",{target_agreement_id:agreementId});assert.equal(scheduleHub.proposals[0].id,scheduleId);assert.equal(scheduleHub.proposals[0].location_detail,"Private test workshop");
  await rpc(provider.token,"respond_schedule_window",{target_proposal_id:scheduleId,response:"accepted"});
  rows=await rpc(owner.token,"get_my_agreements",{});agreement=rows[0];assert.equal(agreement.agreement.status,"scheduled");

  await rpc(owner.token, "perform_agreement_action", { target_agreement_id: agreementId, expected_version: agreement.agreement.version, requested_action: "transition", payload: { status: "active" } });
  rows = await rpc(owner.token, "get_my_agreements", {}); agreement = rows[0];
  const issueId=await rpc(provider.token,"report_work_issue",{target_agreement_id:agreementId,payload:{category:"hidden_condition",title:"Wall blocking discovered",detail:"A concealed masonry block requires different anchors and additional fitting time.",milestone_id:"",obligation_id:"",unaffected_work_can_continue:true}});
  const changeId=await rpc(provider.token,"propose_change_order",{target_issue_id:issueId,payload:{scope_delta:"Use masonry anchors for the affected shelf",time_delta_minutes:45,cash_delta_cents:1800,barter_delta:"",schedule_delta:"No date change"}});
  let changeHub=await rpc(owner.token,"get_change_order_hub",{target_agreement_id:agreementId});assert.equal(changeHub.issues[0].orders[0].id,changeId);assert.equal(changeHub.baseline.version,agreement.agreement.version);
  await rpc(owner.token,"respond_change_order",{target_change_order_id:changeId,accept:true});rows=await rpc(owner.token,"get_my_agreements",{});agreement=rows[0];assert.match(agreement.agreement.scope_snapshot,/masonry anchors/);changeHub=await rpc(owner.token,"get_change_order_hub",{target_agreement_id:agreementId});assert.equal(changeHub.issues[0].status,"resolved");
  await request("/rest/v1/project_messages", { token: provider.token, method: "POST", headers: { Prefer: "return=minimal" }, body: { request_id: requestId, author_id: provider.id, body: "Materials are ready; arrival is scheduled for Saturday." } });
  notifications=await rpc(owner.token,"get_my_notifications",{});
  assert.equal(notifications.some((row)=>row.notification.kind==="message"),true);
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

  await rpc(owner.token,"handle_completion",{target_agreement_id:agreementId,expected_version:agreement.agreement.version,action:"request"});
  rows = await rpc(provider.token, "get_my_agreements", {}); agreement = rows[0];
  await assert.rejects(()=>rpc(owner.token,"handle_completion",{target_agreement_id:agreementId,expected_version:agreement.agreement.version,action:"approve"}),/counterparty approval/i);
  await rpc(provider.token,"handle_completion",{target_agreement_id:agreementId,expected_version:agreement.agreement.version,action:"approve"});
  await request("/rest/v1/work_reviews", { token: owner.token, method: "POST", headers: { Prefer: "return=representation" }, body: { agreement_id: agreementId, reviewer_id: owner.id, subject_id: provider.id, reliability: 5, communication: 5, work_quality: 5, exchange_fairness: 5, body: "Clear scope and dependable follow-through." } });

  rows = await rpc(owner.token, "get_my_agreements", {});
  assert.equal(rows[0].agreement.status, "completed");
  assert.ok(rows[0].obligations.every((item) => item.status === "fulfilled"));
  assert.equal(rows[0].evidence.length, 1);
  const history=await request(`/rest/v1/agreement_history?agreement_id=eq.${agreementId}&select=*`,{token:owner.token});assert.ok(history.length>=5);
  const exported=await rpc(owner.token,"export_my_data",{});
  assert.equal(exported.profile.id,owner.id);
  assert.equal(exported.agreements.length,1);
  await rpc(owner.token,"deactivate_my_account",{});
  const deactivated=(await request(`/rest/v1/profiles?id=eq.${owner.id}&select=display_name,is_active`,{token:owner.token}))[0];
  assert.equal(deactivated.is_active,false);
  assert.equal(deactivated.display_name,"Former WorkTrade member");
  console.log("WorkTrade two-user lifecycle passed against hosted Supabase.");
} finally {
  await cleanup();
}
