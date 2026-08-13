import { getBackend, getSession, assertBackend } from "./core.js";

export async function publishCompletion(
  agreementId,
  summary,
  exchangeBreakdown,
  title,
  visibility,
) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("publish_completion", {
    target_agreement_id: agreementId,
    summary_text: summary,
    exchange_items: { summary: exchangeBreakdown || "" },
    portfolio_title: title,
    portfolio_visibility: visibility,
  });
  if (error) throw error;
  return data;
}

export async function discoverProfiles({
  query = "",
  exchange = null,
  remote = false,
} = {}) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("discover_profiles", {
    search_text: query,
    exchange_filter: exchange,
    remote_only: remote,
  });
  if (error) throw error;
  return Promise.all(data.map(async (row) => {
    const profile = { ...row.profile, capabilities: row.capabilities, portfolio: row.portfolio, reviews: row.reviews };
    if (profile.avatar_path) {
      const { data: signed } = await client.storage.from("profile-media").createSignedUrl(profile.avatar_path, 3600);
      profile.avatar_url = signed?.signedUrl || "";
    }
    profile.portfolio = await Promise.all((profile.portfolio || []).map(async (entry) => {
      if (!entry.asset_path) return entry;
      const { data: signed } = await client.storage.from("profile-media").createSignedUrl(entry.asset_path, 3600);
      return { ...entry, asset_url: signed?.signedUrl || "" };
    }));
    return profile;
  }));
}

export async function getNetworkActivity(followingOnly = false) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("get_network_activity", {
    following_only: followingOnly,
  });
  if (error) throw error;
  return data.map(({ activity: x }) => ({
    type: x.kind,
    created_at: x.at,
    actor_name: x.name,
    ...x,
  }));
}

export async function setFollow(profileId, follow) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("set_follow", {
    target_profile_id: profileId,
    should_follow: follow,
  });
  if (error) throw error;
}

export async function recordMatchEvent({ profileId = null, requestId = null, event, reason = null }) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("record_match_event", { profile_value: profileId, request_value: requestId, event_value: event, reason_value: reason });
  if (error) throw error;
}

export async function recommendProfilesForRequest(requestId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("recommend_profiles_for_request", { target_request_id: requestId });
  if (error) throw error;
  return data || [];
}

export async function notifyProjectMatches(requestId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("notify_project_matches", { target_request_id: requestId });
  if (error) throw error;
  return data;
}

export async function getNetworkInbox() {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("get_network_inbox");
  if (error) throw error;
  data.attachments = await Promise.all((data.attachments || []).map(async (item) => {
    const { data: signed } = await client.storage.from("message-attachments").createSignedUrl(item.asset_path, 900);
    return { ...item, url: signed?.signedUrl || "" };
  }));
  return data;
}

export async function sendCollaborationInvitation(
  profileId,
  { need, offer, note, requestId = null },
) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("send_collaboration_invitation", {
    target_profile_id: profileId,
    need_value: need,
    offer_value: offer,
    note_value: note,
    target_request_id: requestId,
  });
  if (error) throw error;
  return data;
}

export async function sendContactRequest(profileId, message, requestId = null, kind = "message") {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("send_contact_request", {
    target_profile_id: profileId,
    message_body: message,
    target_request_id: requestId || null,
    contact_kind: kind,
  });
  if (error) throw error;
  return data;
}

export async function respondCollaborationInvitation(id, response) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("respond_collaboration_invitation", {
    target_invitation_id: id,
    response,
  });
  if (error) throw error;
}

export async function sendIntroductionMessage(id, body) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("send_introduction_message", {
    target_invitation_id: id,
    message_body: body,
  });
  if (error) throw error;
  return data;
}

export async function sendMessageAttachment(id, body, file) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to attach a file");
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${id}/${session.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from("message-attachments").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await client.rpc("send_message_with_attachment", {
    target_invitation_id: id,
    message_body: body || "",
    attachment_path: path,
    attachment_name: file.name,
    attachment_type: file.type || "application/octet-stream",
    attachment_size: file.size,
  });
  if (error) {
    await client.storage.from("message-attachments").remove([path]);
    throw error;
  }
  return data;
}

export async function subscribeToMessages(onChange) {
  const client = await getBackend();
  assertBackend(client);
  return client.channel("worktrade-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "introduction_messages" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "collaboration_invitations" }, onChange)
    .subscribe();
}

export async function manageConversation(id, action) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("manage_conversation", {
    target_invitation_id: id,
    requested_action: action,
  });
  if (error) throw error;
}

export async function setSavedProfile(profileId, save) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("set_saved_profile", {
    target_profile_id: profileId,
    should_save: save,
  });
  if (error) throw error;
}

export async function saveNetworkSearch(name, query, exchange, remote) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("save_network_search", {
    search_name: name,
    search_query: query,
    exchange_value: exchange,
    remote_value: remote,
  });
  if (error) throw error;
  return data;
}

export async function saveDiscoveryAlert(name, filters) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("save_network_search_v2", {
    search_name: name,
    search_query: filters.query || "",
    exchange_value: filters.exchange || "",
    discovery_value: filters.mode || "either",
    radius_value: filters.radius || null,
    availability_value: filters.availability || "",
    sort_value: filters.sort || "fit",
    alerts_value: filters.alerts !== false,
  });
  if (error) throw error;
  return data;
}

export async function updateIntroductionWorkspace(
  invitationId,
  version,
  payload,
) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("update_introduction_workspace", {
    target_invitation_id: invitationId,
    expected_version: version,
    payload,
  });
  if (error) throw error;
  return data;
}

export async function confirmIntroductionWorkspace(invitationId, version) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("confirm_introduction_workspace", {
    target_invitation_id: invitationId,
    expected_version: version,
  });
  if (error) throw error;
  return data;
}

export async function convertIntroductionToRequest(invitationId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("convert_introduction_to_request", {
    target_invitation_id: invitationId,
  });
  if (error) throw error;
  return data;
}

export async function manageNetworkItem(kind, id, action) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("manage_network_item", {
    item_kind: kind,
    target_id: id,
    action,
  });
  if (error) throw error;
}
