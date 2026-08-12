import { getBackend, getSession, assertBackend } from "./core.js";

export async function submitSafetyReport(
  targetType,
  targetId,
  category,
  detail,
) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("submit_safety_report", {
    report_target_type: targetType,
    report_target_id: targetId,
    report_category: category,
    report_detail: detail,
  });
  if (error) throw error;
  return data;
}

export async function getMySafetyReports() {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("get_my_safety_reports");
  if (error) throw error;
  return data;
}

export async function getMyRestrictions() {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await client
    .from("account_restrictions")
    .select("*")
    .eq("profile_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getModerationQueue() {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("get_moderation_queue");
  if (error) throw error;
  return data;
}

export async function moderateReport(
  reportId,
  action,
  internalNote,
  reporterUpdate = "",
  expiresAt = null,
) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("moderate_report", {
    target_report_id: reportId,
    moderation_action: action,
    internal_note_value: internalNote,
    reporter_update_value: reporterUpdate,
    restriction_expires_at: expiresAt,
  });
  if (error) throw error;
}

export async function submitModerationAppeal(restrictionId, statement) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("submit_moderation_appeal", {
    target_restriction_id: restrictionId,
    appeal_statement: statement,
  });
  if (error) throw error;
  return data;
}

export async function resolveModerationAppeal(
  appealId,
  decision,
  internalNote,
  memberUpdate,
) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("resolve_moderation_appeal", {
    target_appeal_id: appealId,
    appeal_decision: decision,
    internal_note_value: internalNote,
    member_update_value: memberUpdate,
  });
  if (error) throw error;
}

export async function submitReview(input) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to leave feedback");
  const { data, error } = await client
    .from("work_reviews")
    .insert({ ...input, reviewer_id: session.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadWorkEvidence(
  agreementId,
  file,
  { skill, description },
) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to add evidence");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${agreementId}/${session.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage
    .from("work-evidence")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await client
    .from("work_evidence")
    .insert({
      agreement_id: agreementId,
      contributor_id: session.user.id,
      skill,
      description,
      asset_path: path,
    })
    .select()
    .single();
  if (error) {
    await client.storage.from("work-evidence").remove([path]);
    throw error;
  }
  return data;
}

export async function getEvidenceUrl(path) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.storage
    .from("work-evidence")
    .createSignedUrl(path, 900);
  if (error) throw error;
  return data.signedUrl;
}

export async function getNotifications() {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("get_my_notifications");
  if (error) throw error;
  return data.map((row) => row.notification);
}

export async function markNotificationsRead(ids = null) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("mark_notifications_read", {
    notification_ids: ids,
  });
  if (error) throw error;
  return data;
}

export async function getNotificationPreferences() {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await client
    .from("notification_preferences")
    .select("*")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  return (
    data || {
      profile_id: session.user.id,
      in_app: true,
      email_enabled: true,
      email_proposals: true,
      email_messages: true,
      email_agreements: true,
      email_reminders: false,
      email_network: true,
      email_safety: true,
    }
  );
}

export async function saveNotificationPreferences(values) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to save preferences");
  const { data, error } = await client
    .from("notification_preferences")
    .upsert({
      ...values,
      profile_id: session.user.id,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function exportMyData() {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("export_my_data");
  if (error) throw error;
  return data;
}

export async function deactivateMyAccount() {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("deactivate_my_account");
  if (error) throw error;
  await client.auth.signOut();
}
