import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type OutboxItem = {
  id: string;
  profile_id: string;
  template_key: string;
  subject: string;
  action_path: string;
};

const copy: Record<string, string> = {
  proposal: "A proposal related to your work is ready to review.",
  message: "New activity is waiting in your private WorkTrade workspace.",
  agreement: "One of your WorkTrade agreements has changed.",
  network: "You have new activity in your WorkTrade network.",
  safety: "An important safety or account decision is ready to review securely.",
  reminder: "A time-sensitive WorkTrade item needs your attention.",
  system: "There is an update to your WorkTrade account.",
};

function render(item: OutboxItem, appUrl: string) {
  const actionUrl = new URL(item.action_path, appUrl).toString();
  const message = copy[item.template_key] || copy.system;
  return {
    subject: item.subject,
    text: `${message}\n\nOpen WorkTrade: ${actionUrl}\n\nThis email intentionally excludes private messages, exchange details, and confidential moderation notes.`,
    html: `<p>${message}</p><p><a href="${actionUrl}">Open WorkTrade securely</a></p><p><small>This email intentionally excludes private messages, exchange details, and confidential moderation notes.</small></p>`,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  const authorization = request.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  let role = "";
  try {
    role = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role;
  } catch {}
  if (!serviceKey || role !== "service_role")
    return Response.json({ error: "Service authorization required" }, { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const mode = Deno.env.get("EMAIL_DELIVERY_MODE") || "sink";
  if (!['sink', 'resend'].includes(mode))
    return Response.json({ error: "Invalid delivery mode" }, { status: 500 });
  const appUrl = Deno.env.get("WORKTRADE_APP_URL") ||
    "https://jay23606.github.io/worktrade/";
  const requestedBatch = Number((await request.json().catch(() => ({}))).limit || 25);
  const { error: reminderError } = await supabase.rpc("queue_offer_expiration_warnings");
  if (reminderError)
    return Response.json({ error: reminderError.message }, { status: 500 });
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_email_deliveries",
    { batch_size: Math.max(1, Math.min(requestedBatch, 100)) },
  );
  if (claimError)
    return Response.json({ error: claimError.message }, { status: 500 });

  const results = [];
  for (const item of (claimed || []) as OutboxItem[]) {
    try {
      const { data: userData, error: userError } =
        await supabase.auth.admin.getUserById(item.profile_id);
      if (userError || !userData.user?.email)
        throw new Error("recipient_unavailable");
      const rendered = render(item, appUrl);
      let providerId = `sink:${item.id}`;
      if (mode === "resend") {
        const apiKey = Deno.env.get("RESEND_API_KEY");
        const from = Deno.env.get("EMAIL_FROM");
        if (!apiKey || !from) throw new Error("provider_not_configured");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": item.id,
          },
          body: JSON.stringify({
            from,
            to: [userData.user.email],
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
          }),
        });
        const providerResult = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(`provider_${response.status}`);
        providerId = providerResult.id || `resend:${item.id}`;
      }
      const { error } = await supabase.rpc("finish_email_delivery", {
        target_outbox_id: item.id,
        delivery_mode_value: mode,
        delivered: true,
        provider_message_id_value: providerId,
        error_code_value: null,
      });
      if (error) throw error;
      results.push({ id: item.id, status: "sent", mode });
    } catch (error) {
      const code = error instanceof Error ? error.message : "delivery_failed";
      await supabase.rpc("finish_email_delivery", {
        target_outbox_id: item.id,
        delivery_mode_value: mode,
        delivered: false,
        provider_message_id_value: null,
        error_code_value: code,
      });
      results.push({ id: item.id, status: "failed", code });
    }
  }
  return Response.json({ mode, processed: results.length, results });
});
