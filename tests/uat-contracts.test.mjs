import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const app = await readFile(new URL("app.js", root), "utf8");
const backendFiles = [
  "backend.js",
  "backend/core.js",
  "backend/requests.js",
  "backend/agreements.js",
  "backend/network.js",
  "backend/circles.js",
  "backend/chains.js",
  "backend/trust.js",
  "backend/pilot.js",
];
const backend = (
  await Promise.all(
    backendFiles.map((name) =>
      readFile(new URL(`modules/${name}`, root), "utf8"),
    ),
  )
).join("\n");
const workflow = await readFile(
  new URL(".github/workflows/pages.yml", root),
  "utf8",
);
const migrations = await Promise.all(
  (await readdir(new URL("supabase/migrations/", root)))
    .filter((name) => name.endsWith(".sql"))
    .map((name) =>
      readFile(new URL(`supabase/migrations/${name}`, root), "utf8"),
    ),
);
const sql = migrations.join("\n");
const circleRlsFix = await readFile(
  new URL(
    "supabase/migrations/20260812190000_circle_rls_recursion_fix.sql",
    root,
  ),
  "utf8",
);
const chainAliasFix = await readFile(
  new URL(
    "supabase/migrations/20260812191000_chain_proposer_alias_fix.sql",
    root,
  ),
  "utf8",
);

test("production artifact excludes repository and backend internals", () => {
  assert.match(workflow, /path: dist/);
  assert.doesNotMatch(workflow, /path: \./);
  assert.match(
    workflow,
    /cp index\.html styles\.css app\.js config\.js data\.js dist\//,
  );
});

test("private circle data requires active membership", () => {
  assert.match(sql, /visibility='circle'.*status='active'/s);
  assert.match(sql, /active members read circle resources/);
  assert.match(sql, /circle membership scoped read/);
});

test("circle membership authorization avoids recursive RLS", () => {
  assert.match(circleRlsFix, /security definer/);
  assert.match(circleRlsFix, /is_active_circle_member\(circle_id\)/);
  assert.doesNotMatch(
    circleRlsFix,
    /circle membership scoped read[\s\S]*exists\s*\(\s*select 1\s+from public\.circle_members mine/,
  );
});

test("circle membership approval is safe to retry", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813070000_idempotent_circle_membership.sql", root), "utf8");
  assert.match(sql, /member_action='approve'[\s\S]*target\.status in\('requested','active'\)/);
  assert.match(sql, /mine\.status='active'[\s\S]*mine\.role in\('owner','moderator'\)/);
  assert.match(sql, /status='requested'/);
});

test("trade chains require closed loops and unanimous versioned consent", () => {
  assert.match(sql, /chain requires at least three unique reciprocal links/);
  assert.match(sql, /links must form one closed loop/);
  assert.match(sql, /accepted_count=participant_count/);
  assert.match(sql, /version=c\.version/);
});

test("chain proposer validation uses unambiguous JSON link aliases", () => {
  assert.match(chainAliasFix, /as proposed_link\(value\)/);
  assert.match(chainAliasFix, /link_item jsonb/);
  assert.doesNotMatch(chainAliasFix, /jsonb_array_elements\(links\) item/);
});

test("private introductions require acceptance and honor blocking", () => {
  assert.match(sql, /accepted invitation required/);
  assert.match(sql, /interaction unavailable/);
  assert.match(sql, /daily invitation limit reached/);
});

test("private-project conversion requires both current confirmations", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813005000_introduction_confirmation_guard.sql", root), "utf8");
  assert.match(sql, /sender_confirmed_version is distinct from w\.version/);
  assert.match(sql, /recipient_confirmed_version is distinct from w\.version/);
});

test("local discovery redacts profile location and stores privacy-safe alerts", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813013000_private_local_discovery.sql", root), "utf8");
  assert.match(sql, /to_jsonb\(p\)-'deactivated_at'-'location_text'/);
  assert.match(sql, /case when p\.location_visibility='region'/);
  assert.match(sql, /location_band/);
  assert.match(sql, /save_network_search_v2/);
});

test("skill discovery normalizes aliases and explains reciprocal fit", () => {
  assert.match(sql,/create table public\.skill_aliases/);
  assert.match(sql,/canonical_skill/);
  assert.match(sql,/'match_reasons'/);
  assert.match(sql,/'matched_offers'/);
  assert.match(app,/does not collect coordinates or reveal exact addresses/);
});

test("scheduling is private, reciprocal, and calendar-portable", () => {
  assert.match(sql,/create table public\.schedule_proposals/);
  assert.match(sql,/participants read schedule proposals/);
  assert.match(sql,/respond_schedule_window/);
  assert.match(sql,/weather_sensitive/);
  assert.match(app,/BEGIN:VCALENDAR/);
  for(const operation of ["getAgreementSchedule","proposeScheduleWindow","respondScheduleWindow","saveMyAvailability"])assert.match(backend,new RegExp(operation));
});

test("agreement preparation ledger tracks readiness and mutual cost approval",()=>{
  assert.match(sql,/create table public\.agreement_ledger_items/);assert.match(sql,/participants read ledger/);assert.match(sql,/agreement_ledger_approvals/);assert.match(sql,/actual_cost_cents/);assert.match(sql,/receipt_path/);
  for(const operation of["getAgreementLedger","saveLedgerItem","manageLedgerItem","uploadLedgerReceipt"])assert.match(backend,new RegExp(operation));
});

test("active work issues preserve baseline and require change-order consent",()=>{
  assert.match(sql,/create table public\.work_issues/);assert.match(sql,/create table public\.change_orders/);assert.match(sql,/unaffected_work_can_continue/);assert.match(sql,/counterparty response required/);assert.match(sql,/Accepted change order/);assert.match(sql,/status='disputed'/);
  for(const operation of["getChangeOrderHub","reportWorkIssue","proposeChangeOrder","respondChangeOrder","manageWorkIssue","uploadWorkIssueEvidence"])assert.match(backend,new RegExp(operation));
});

test("moderation data is private and restrictions guard interaction writes", () => {
  assert.match(sql, /moderation_actions_immutable/);
  assert.match(sql, /staff authorization required/);
  assert.match(sql, /account interaction restricted/);
  assert.match(sql, /reporter_status/);
  assert.match(sql, /resolve_moderation_appeal/);
  assert.doesNotMatch(
    sql,
    /create policy[^;]*moderation_actions[^;]*using\s*\(\s*true\s*\)/i,
  );
});

test("registration is open while legacy invite data and admin operations remain secure", async () => {
  assert.match(sql, /pilot_invite_codes/);
  assert.match(sql, /extensions\.digest\(upper\(trim\(invite_code\)\),'sha256'\)/);
  assert.match(sql, /admin authorization required/);
  assert.match(sql, /insert into public\.pilot_memberships/);
  assert.match(sql, /exists\(select 1 from public\.pilot_memberships where profile_id=target_profile_id and status='active'\)/);
  assert.doesNotMatch(sql, /pilot_invite_codes[^;]*\bcode\s+text/i);
  for (const operation of ["getPilotAccess","redeemPilotInvite","getPilotDashboard","createPilotInvite"])
    assert.match(backend, new RegExp(operation));
  const open = await readFile(new URL("supabase/migrations/20260813050000_open_registration.sql", root), "utf8");
  assert.match(open, /enroll_open_registration/);
  assert.match(open, /'member',auth\.uid\(\) is not null/);
  assert.doesNotMatch(open, /account_can_interact[\s\S]*pilot_memberships[\s\S]*\$\$/);
});

test("pilot feedback is private, contextual, and admin triaged", () => {
  assert.match(sql,/submit_pilot_feedback/);
  assert.match(sql,/members read own feedback/);
  assert.match(sql,/feedback_view/);
  assert.match(sql,/admin authorization required/);
  assert.match(sql,/'funnel'/);
  for (const operation of ["submitPilotFeedback","getMyPilotFeedback","managePilotFeedback","replyToPilotFeedback"]) assert.match(backend,new RegExp(operation));
});

test("transactional email uses a private idempotent outbox with safe templates", () => {
  assert.match(sql, /notification_id uuid not null unique/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /attempts < 5/);
  assert.match(sql, /email_delivery_attempts/);
  assert.doesNotMatch(
    sql,
    /insert into public\.email_outbox[\s\S]{0,1000}new\.body/i,
  );
});

test("client exposes the primary UAT journeys through backend operations", () => {
  for (const operation of [
    "createRemoteRequest",
    "sendCollaborationInvitation",
    "createCircleRequest",
    "createTradeChain",
    "manageTradeChainLink",
  ])
    assert.match(app, new RegExp(operation));
  for (const rpc of [
    "create_work_request",
    "send_collaboration_invitation",
    "create_circle_request",
    "create_trade_chain",
    "manage_trade_chain_link",
  ])
    assert.match(backend, new RegExp(rpc));
});

test("legacy network renderers are not retained", () => {
  assert.doesNotMatch(app, /function renderLegacyNetwork/);
  assert.doesNotMatch(app, /function renderNetworkBase/);
  assert.doesNotMatch(app, /function peopleCards/);
});

test("backend facade preserves domain API after module split", async () => {
  const facade = await import(new URL("modules/backend.js", root));
  for (const operation of [
    "createRequest",
    "performAgreementAction",
    "sendCollaborationInvitation",
    "createCircle",
    "createTradeChain",
    "submitReview",
    "submitSafetyReport",
    "getModerationQueue",
    "resolveModerationAppeal",
    "getPilotDashboard",
    "redeemPilotInvite",
  ])
    assert.equal(typeof facade[operation], "function");
});

test("proposal counters are versioned and require a counterparty response", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813028000_versioned_offer_counters.sql", root), "utf8");
  assert.match(sql, /create table if not exists public\.trade_offer_versions/);
  assert.match(sql, /create or replace function public\.counter_trade_offer/);
  assert.match(sql, /auth\.uid\(\)=o\.last_proposed_by/);
  assert.match(sql, /proposal_version/);
  const defaults = await readFile(new URL("supabase/migrations/20260813029000_offer_counter_defaults.sql", root), "utf8");
  assert.match(defaults, /set default auth\.uid\(\)/);
  assert.match(defaults, /last_proposed_by set not null/);
  const backend = await readFile(new URL("modules/backend/agreements.js", root), "utf8");
  assert.match(backend, /export async function counterOffer/);
  assert.match(backend, /export async function declineOffer/);
});

test("negotiation activity reaches the inbox and transactional outbox", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813030000_negotiation_inbox_notifications.sql", root), "utf8");
  assert.match(sql, /Counterproposal received/);
  assert.match(sql, /changed:/);
  assert.match(sql, /queue_offer_expiration_warnings/);
  const dispatcher = await readFile(new URL("supabase/functions/email-dispatch/index.ts", root), "utf8");
  assert.match(dispatcher, /queue_offer_expiration_warnings/);
});

test("dedicated conversations keep read, archive, and mute state private per member", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813043000_message_inbox.sql", root), "utf8");
  assert.match(sql, /conversation_member_state/);
  assert.match(sql, /profile_id=auth\.uid\(\)/);
  assert.match(sql, /requested_action='read'/);
  assert.match(sql, /requested_action='archive'/);
  assert.match(sql, /requested_action='mute'/);
  assert.match(sql, /unread_count/);
  const client = await readFile(new URL("modules/backend/network.js", root), "utf8");
  assert.match(client, /export async function manageConversation/);
});

test("message attachments and delivery state stay participant-private", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813053000_message_delivery_attachments.sql", root), "utf8");
  assert.match(sql, /message-attachments/);
  assert.match(sql, /conversation participants read attachments/);
  assert.match(sql, /auth\.uid\(\) in\(i\.sender_id,i\.recipient_id\)/);
  assert.match(sql, /other_read_at/);
  assert.match(sql, /supabase_realtime/);
  const client = await readFile(new URL("modules/backend/network.js", root), "utf8");
  assert.match(client, /sendMessageAttachment/);
  assert.match(client, /createSignedUrl/);
  assert.match(client, /subscribeToMessages/);
  assert.match(app, /MESSAGE_DRAFT_KEY/);
  assert.match(app, /Shift\+Enter/);
});

test("conversation requests refresh in realtime and crossed requests open one thread", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813073000_realtime_conversation_requests.sql", root), "utf8");
  assert.match(sql, /supabase_realtime add table public\.collaboration_invitations/);
  assert.match(sql, /reverse_item[\s\S]*status='accepted'/);
  assert.match(sql, /delete from public\.collaboration_invitations[\s\S]*remove_id/);
  const client = await readFile(new URL("modules/backend/network.js", root), "utf8");
  assert.match(client, /table: "collaboration_invitations"/);
  assert.match(app, /state\.view === "messages" && state\.session\) loadNetwork\(\)/);
});

test("each participant pair has only one live conversation", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813080000_one_conversation_per_pair.sql", root), "utf8");
  assert.match(sql, /update public\.introduction_messages set invitation_id=keeper/);
  assert.match(sql, /one_live_conversation_per_pair/);
  assert.match(sql, /status in\('pending','accepted','converted'\)/);
  assert.match(app, /seenPeople\.has\(otherId\)/);
});

test("formal exchange reuses an existing conversation", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813083000_reuse_conversation_for_exchange.sql", root), "utf8");
  assert.match(sql, /conversation_pair=/);
  assert.match(sql, /invitation_kind='exchange'/);
  assert.match(sql, /insert into public\.introduction_messages/);
});

test("matching combines related skills, practical fit, and private outcomes", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260813090000_outcome_aware_matching.sql", root), "utf8");
  assert.match(sql, /skill_family/);
  assert.match(sql, /availability_overlap/);
  assert.match(sql, /resource_fit/);
  assert.match(sql, /match_events/);
  assert.match(sql, /event_kind when'useful'then 3 when'dismissed'then-12/);
  assert.match(sql, /Worked together successfully/);
  assert.match(app, /recordMatchKey/);
});
