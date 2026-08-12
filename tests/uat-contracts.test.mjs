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
  ])
    assert.equal(typeof facade[operation], "function");
});
