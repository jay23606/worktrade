import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (request) => {
  const headers = { "Content-Type": "application/json" };
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers });
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { action, agreementId, expectedVersion, payload = {} } = await request.json();
    const mappedAction = ["dispute", "cancel", "confirm"].includes(action) ? action : "transition";
    const rpcPayload = mappedAction === "transition" ? { ...payload, status: action } : payload;
    const { data, error } = await client.rpc("perform_agreement_action", {
      target_agreement_id: agreementId,
      expected_version: expectedVersion,
      requested_action: mappedAction,
      payload: rpcPayload,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ agreement: data }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Agreement action failed" }), { status: 400, headers });
  }
});
