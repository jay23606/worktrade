import { getBackend, assertBackend } from "./core.js";

async function call(name, body = {}) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc(name, body);
  if (error) throw error;
  return data;
}

export const getPilotAccess = () => call("get_pilot_access");
export const redeemPilotInvite = (code) =>
  call("redeem_pilot_invite", { invite_code: code });
export const getPilotDashboard = () => call("get_pilot_dashboard");
export const createPilotInvite = (label, maxUses, expiresAt = null) =>
  call("create_pilot_invite", {
    invite_label: label,
    invite_max_uses: maxUses,
    invite_expires_at: expiresAt,
  });
export const setPilotInviteEnabled = (id, enabled) =>
  call("set_pilot_invite_enabled", {
    target_invite_id: id,
    enabled,
  });
export const submitPilotFeedback = (category, body, view, stage, context={}) => call("submit_pilot_feedback", { feedback_category:category, feedback_body:body, feedback_view:view, feedback_stage:stage, feedback_context:context });
export const getMyPilotFeedback = () => call("get_my_pilot_feedback");
export const managePilotFeedback = (id, status, severity, assignee=null, note="", reply="") => call("manage_pilot_feedback", { target_feedback_id:id, next_status:status, next_severity:severity, assignee_id:assignee||null, note, public_reply:reply });
export const replyToPilotFeedback = (id, body) => call("reply_to_pilot_feedback", { target_feedback_id:id, reply_body:body });
